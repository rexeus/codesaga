// An HttpClient that answers GitHub GraphQL requests from a script and records them, so no journey touches a network.
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

const RequestBody = Schema.fromJsonString(
  Schema.Struct({
    variables: Schema.Struct({
      q: Schema.String,
      cursor: Schema.NullOr(Schema.String),
    }),
  }),
);

/** What the command under test sent to GitHub. */
export type GithubRequest = {
  readonly url: string;
  readonly authorization: string | undefined;
  /** The search string and page cursor of the GraphQL variables. */
  readonly search: string;
  readonly cursor: string | null;
};

/** One scripted answer. */
export type GithubReply = {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
};

/** A GraphQL search result with `nodes` and no further page. */
export const searchResult = (nodes: ReadonlyArray<unknown>): GithubReply => ({
  body: {
    data: {
      search: {
        issueCount: nodes.length,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes,
      },
    },
  },
});

/** The answer to a request nobody scripted: an error, so an unexpected request fails loudly. */
export const unscripted: GithubReply = {
  status: 500,
  body: { message: "unscripted request" },
};

/** A client answering with `reply`; `requests` fills as the command sends them. */
export const stubGithub = (
  reply: (request: GithubRequest) => GithubReply,
): {
  readonly requests: Array<GithubRequest>;
  readonly layer: Layer.Layer<HttpClient.HttpClient>;
} => {
  const requests: Array<GithubRequest> = [];
  const client = HttpClient.make((request) => {
    const { variables } = Schema.decodeSync(RequestBody)(
      request.body._tag === "Uint8Array"
        ? new TextDecoder().decode(request.body.body)
        : "",
    );
    const recorded: GithubRequest = {
      url: request.url,
      authorization: request.headers["authorization"],
      search: variables.q,
      cursor: variables.cursor,
    };
    requests.push(recorded);
    const scripted = reply(recorded);
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
