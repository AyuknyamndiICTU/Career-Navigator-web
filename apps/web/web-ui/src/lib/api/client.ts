// Typed requests over the generated OpenAPI schema (`npm run api:openapi` regenerates schema.d.ts).
import { apiFetch } from '../auth';
import type { paths } from './schema';

/** Routes without the global /api prefix, e.g. '/jobs/{jobId}/apply'. */
type Routes = { [K in keyof paths as K extends `/api${infer R}` ? R : never]: paths[K] };
export type ApiRoute = keyof Routes;
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

type Operation<R extends ApiRoute, M extends Method> = NonNullable<Routes[R][M]>;
export type ApiMethod<R extends ApiRoute> = {
  [M in Method]: [Operation<R, M>] extends [never] ? never : M;
}[Method];

type JsonBody<Op> = Op extends { requestBody?: { content: { 'application/json': infer B } } }
  ? B
  : never;
type PathParams<Op> = Op extends { parameters: { path?: infer P } } ? NonNullable<P> : never;
type QueryParams<Op> = Op extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type JsonResponse<Op> = Op extends { responses: infer Rs }
  ? {
      [C in keyof Rs]: C extends 200 | 201
        ? Rs[C] extends { content: { 'application/json': infer J } }
          ? J
          : never
        : never;
    }[keyof Rs]
  : never;
/** Most controllers don't declare a response schema yet; those stay `unknown`. */
type ResponseOf<Op> = [JsonResponse<Op>] extends [never] ? unknown : JsonResponse<Op>;

export type ApiRequestOptions<Op> = {
  params?: PathParams<Op>;
  query?: QueryParams<Op>;
  body?: JsonBody<Op>;
};

export function buildApiPath(
  route: string,
  params?: Record<string, unknown>,
  query?: Record<string, unknown>,
): string {
  const path = route.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path parameter "${name}" for ${route}`);
    }
    return encodeURIComponent(String(value));
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** `apiRequest('post', '/jobs/{jobId}/apply', { params: { jobId }, body })` — body and params are checked against the API. */
export function apiRequest<
  R extends ApiRoute,
  M extends ApiMethod<R>,
  T = ResponseOf<Operation<R, M>>,
>(method: M, route: R, options: ApiRequestOptions<Operation<R, M>> = {}): Promise<T> {
  const path = buildApiPath(
    route,
    options.params as Record<string, unknown> | undefined,
    options.query as Record<string, unknown> | undefined,
  );
  return apiFetch(path, { method: method.toUpperCase(), body: options.body });
}
