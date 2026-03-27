import { createStart } from "@tanstack/react-start";
import { dbMiddleware } from "~/middleware/db";

export const startInstance = createStart(() => ({
  requestMiddleware: [dbMiddleware],
}));
