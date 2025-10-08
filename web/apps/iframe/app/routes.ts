import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/register.tsx"),
  route("app", "routes/app.tsx"),
] satisfies RouteConfig;
