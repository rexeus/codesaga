// Owns one GraphQL request to GitHub: authentication, retry of a gateway failure, and mapping every way it can fail.
// A response counts as success only with HTTP 200, no GraphQL errors and the expected shape.
import { DateTime, Effect, Option, Schedule, Schema } from "effect";
import type { Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import {
  GithubRateLimited,
  GithubRequestFailed,
  GithubTokenRejected,
} from "./github-errors.js";

const GraphqlErrors = Schema.Array(
  Schema.Struct({
    type: Schema.optionalKey(Schema.String),
    message: Schema.String,
  }),
);

const Message = Schema.Struct({ message: Schema.String });

const Failure = Schema.Struct({ errors: GraphqlErrors });

const GATEWAY_FAILURES: ReadonlySet<number> = new Set([502, 503]);
const RETRY_DELAY = "1 second";

/** Where and as whom a request goes. */
type Endpoint = {
  readonly host: string;
  readonly url: string;
  readonly token: Redacted.Redacted;
};

const header = (
  response: HttpClientResponse.HttpClientResponse,
  name: string,
): string | undefined => response.headers[name];

/**
 * When the limit lifts: `retry-after` seconds from now, which GitHub sends for
 * a secondary limit whose reset header names the primary one; else the reset
 * header (epoch seconds); null if neither says.
 */
const resetAt = (
  response: HttpClientResponse.HttpClientResponse,
  now: DateTime.Utc,
): string | null => {
  const wait = Number(header(response, "retry-after"));
  const reset = Number(header(response, "x-ratelimit-reset"));
  if (Number.isFinite(wait) && wait > 0) {
    return DateTime.formatIso(DateTime.add(now, { seconds: wait }));
  }
  return Number.isFinite(reset) && reset > 0
    ? DateTime.formatIso(DateTime.makeUnsafe(reset * 1000))
    : null;
};

/** GitHub signals a primary limit with 403 and an empty quota, a secondary one with 403 or 429 and `retry-after`. */
const isRateLimited = (
  response: HttpClientResponse.HttpClientResponse,
): boolean =>
  response.status === 429 ||
  (response.status === 403 &&
    (header(response, "x-ratelimit-remaining") === "0" ||
      header(response, "retry-after") !== undefined));

const messageOf = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<string> =>
  response.json.pipe(
    Effect.map((json) =>
      Option.match(Schema.decodeUnknownOption(Message)(json), {
        onNone: () => `HTTP ${response.status}`,
        onSome: ({ message }) => message,
      }),
    ),
    Effect.orElseSucceed(() => `HTTP ${response.status}`),
  );

type GithubFailure =
  | GithubRateLimited
  | GithubRequestFailed
  | GithubTokenRejected;

/** The decoded `data` of a successful response. */
const readData = <A>(
  response: HttpClientResponse.HttpClientResponse,
  Data: Schema.Decoder<A>,
  host: string,
): Effect.Effect<A, GithubFailure> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    if (isRateLimited(response)) {
      return yield* new GithubRateLimited({ resetAt: resetAt(response, now) });
    }
    if (response.status === 401) {
      return yield* new GithubTokenRejected({ host });
    }
    if (response.status !== 200) {
      return yield* new GithubRequestFailed({
        status: response.status,
        message: yield* messageOf(response),
      });
    }
    const body = yield* response.json.pipe(
      Effect.mapError(
        () =>
          new GithubRequestFailed({
            status: response.status,
            message: "the response is not JSON",
          }),
      ),
    );
    const failure = Schema.decodeUnknownOption(Failure)(body);
    if (Option.isSome(failure) && failure.value.errors.length > 0) {
      const [first] = failure.value.errors;
      return yield* first?.type === "RATE_LIMITED"
        ? new GithubRateLimited({ resetAt: resetAt(response, now) })
        : new GithubRequestFailed({
            status: null,
            message: first?.message ?? "GitHub reported an error",
          });
    }
    return yield* Schema.decodeUnknownEffect(Schema.Struct({ data: Data }))(
      body,
    ).pipe(
      Effect.map(({ data }) => data),
      Effect.mapError(
        () =>
          new GithubRequestFailed({
            status: response.status,
            message: "the response has an unexpected shape",
          }),
      ),
    );
  });

const gatewayFailure = (error: GithubFailure) =>
  error._tag === "GithubRequestFailed" &&
  error.status !== null &&
  GATEWAY_FAILURES.has(error.status);

/**
 * Posts `query` with `variables` to `endpoint` and decodes the response's
 * `data` with `Data`. A 502 or 503 is tried once more after a second.
 *
 * Fails with `GithubRateLimited` when GitHub refuses until a reset time, with
 * `GithubTokenRejected` when it answers 401, and with `GithubRequestFailed`
 * for an unreachable host, missing permissions, GraphQL errors, or a response
 * of another shape.
 */
export const graphql = <A>(
  endpoint: Endpoint,
  query: string,
  variables: Readonly<Record<string, string | null>>,
  Data: Schema.Decoder<A>,
): Effect.Effect<A, GithubFailure, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* HttpClientRequest.post(endpoint.url).pipe(
      HttpClientRequest.bearerToken(endpoint.token),
      HttpClientRequest.setHeader("User-Agent", "codesaga"),
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyJsonUnsafe({ query, variables }),
      client.execute,
      Effect.mapError(
        (error) =>
          new GithubRequestFailed({ status: null, message: error.message }),
      ),
    );
    return yield* readData(response, Data, endpoint.host);
  }).pipe(
    Effect.retry({
      while: gatewayFailure,
      times: 1,
      schedule: Schedule.spaced(RETRY_DELAY),
    }),
  );
