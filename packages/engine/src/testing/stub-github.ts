// Tests only: an HttpClient that answers GitHub GraphQL requests from a script and records what was sent.
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";

const RequestBody = Schema.fromJsonString(
  Schema.Struct({
    variables: Schema.Struct({
      q: Schema.String,
      cursor: Schema.NullOr(Schema.String),
    }),
  }),
);

/** What the code under test sent to the stub. */
export type RecordedRequest = {
  readonly url: string;
  readonly authorization: string | undefined;
  readonly variables: { readonly q: string; readonly cursor: string | null };
};

/** One scripted answer; `"unreachable"` fails like a refused connection. */
export type StubReply =
  | "unreachable"
  | {
      readonly status?: number;
      readonly headers?: Readonly<Record<string, string>>;
      readonly body?: unknown;
    };

/** The shape of a GraphQL search result page that `nodes` and `next` describe. */
export const searchPage = (
  nodes: ReadonlyArray<unknown>,
  next: string | null = null,
): StubReply => ({
  body: {
    data: {
      search: {
        pageInfo: { hasNextPage: next !== null, endCursor: next },
        nodes,
      },
    },
  },
});

/**
 * A client that answers request number `index` (from 0) with `reply(request, index)`.
 * Nothing is sent over a network.
 */
export const stubGithub = (
  reply: (request: RecordedRequest, index: number) => StubReply,
): {
  readonly requests: ReadonlyArray<RecordedRequest>;
  readonly layer: Layer.Layer<HttpClient.HttpClient>;
} => {
  const requests: Array<RecordedRequest> = [];
  const client = HttpClient.make((request) => {
    const body = Schema.decodeSync(RequestBody)(
      request.body._tag === "Uint8Array"
        ? new TextDecoder().decode(request.body.body)
        : "",
    );
    const recorded: RecordedRequest = {
      url: request.url,
      authorization: request.headers["authorization"],
      ...body,
    };
    requests.push(recorded);
    const scripted = reply(recorded, requests.length - 1);
    if (scripted === "unreachable") {
      return Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({
            request,
            description: "connection refused",
          }),
        }),
      );
    }
    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(scripted.body ?? {}), {
          status: scripted.status ?? 200,
          headers: scripted.headers ?? {},
        }),
      ),
    );
  });
  return { requests, layer: Layer.succeed(HttpClient.HttpClient, client) };
};
