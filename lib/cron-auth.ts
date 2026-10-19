import { timingSafeEqual } from "node:crypto";

// Cron sorğusunun gizli açarla göndərildiyini sabit-vaxt müqayisəsi ilə yoxlayır.
export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET mühit dəyişəni təyin edilməyib.");

  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}
