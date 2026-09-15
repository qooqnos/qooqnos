declare module "*.sql" {
  const source: string;
  export default source;
}

declare module "*.json" {
  const value: unknown;
  export default value;
}
