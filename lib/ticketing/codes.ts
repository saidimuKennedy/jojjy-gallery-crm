import crypto from "crypto";

/** Unguessable, human-typable door code (also the QR payload). */
export function generateTicketCode(): string {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}
