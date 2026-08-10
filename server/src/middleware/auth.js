import jwt from "jsonwebtoken";

export function createAuthMiddleware(config) {
  const authenticate = (req, res, next) => {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }
    try {
      req.user = jwt.verify(header.slice(7), config.jwtSecret, {
        issuer: "worldgpz",
        audience: "worldgpz-admin",
      });
      return next();
    } catch {
      return res
        .status(401)
        .json({ success: false, error: "Session expired or invalid" });
    }
  };

  const adminOnly = (req, res, next) => {
    if (req.user?.role !== "admin")
      return res
        .status(403)
        .json({ success: false, error: "Administrator access required" });
    return next();
  };

  return { authenticate, adminOnly };
}
