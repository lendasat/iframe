import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/register.tsx"),
  layout("routes/app.tsx", [
    index("routes/app/index.tsx"),
    route("app/contracts", "routes/app/contracts.tsx"),
    route("app/contracts/:contractId", "routes/app/contracts.$contractId.tsx"),
    route("app/offers", "routes/app/offers.tsx"),
    route("app/offers/:offerId", "routes/app/offers.$offerId.tsx"),
    route("app/applications", "routes/app/applications.tsx"),
  ]),
] satisfies RouteConfig;
