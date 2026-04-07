/**
 * Extracts :param names from a route template at the type level.
 *
 * @example
 * - 'rooms/:id/run'                // 'id'
 * - 'internal/documents/:roomId'   // 'roomId'
 * - 'rooms'                        // never (no params)
 */
type ExtractParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ExtractParams<Rest>
  : T extends `${string}:${infer Param}`
    ? Param
    : never;

/**
 * Build a URL from a route template and params.
 *
 * @example
 * - buildUrl('rooms/:id/run', { id: '123' })       // 'rooms/123/run'
 * - buildUrl('rooms')                              // 'rooms' (no params needed)
 * - buildUrl('rooms/:id', {})                      // TS error: property 'id' missing
 */
export function buildUrl<T extends string>(
  template: T,
  ...args: [ExtractParams<T>] extends [never] ? [] : [params: Record<ExtractParams<T>, string>]
): string {
  const params = args[0] as Record<string, string> | undefined;
  if (!params) return template;
  return template.replaceAll(/:(\w+)/g, (_, key) => encodeURIComponent(params[key] as string));
}

/**
 * Phantom-typed route. Request/Response types exist only at the type level.
 *
 * The `__brand` field carries phantom types through TypeScript's structural
 * type system so that `RequestOf` / `ResponseOf` can extract them via
 * conditional type inference.
 */
export interface TypedRoute<_TReq = void, _TRes = void> {
  readonly route: string;
  readonly method: string;
  /** @internal - enables phantom type inference; never set at runtime. */
  readonly __brand?: { req: _TReq; res: _TRes };
}

/** Extract the Request type from a TypedRoute */
// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
export type RequestOf<T> = T extends TypedRoute<infer R, any> ? R : never;
/** Extract the Response type from a TypedRoute */
// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
export type ResponseOf<T> = T extends TypedRoute<any, infer R> ? R : never;

/**
 * Define a typed route.
 *
 * Curried so TypeScript can infer the route literal while
 * we explicitly specify Request/Response types.
 *
 * @example
 * defineRoute<CreateDocumentRequest, CreateDocumentResponse>()
 *   ('internal/documents', 'POST')
 */
export function defineRoute<TReq = void, TRes = void>() {
  return <TRoute extends string, TMethod extends string>(
    route: TRoute,
    method: TMethod,
  ): { readonly route: TRoute; readonly method: TMethod } & TypedRoute<TReq, TRes> =>
    ({ route, method }) as { readonly route: TRoute; readonly method: TMethod } & TypedRoute<
      TReq,
      TRes
    >;
}
