import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type UserRole = "admin" | "hod" | "coordinator" | "teacher" | "student" | "finance_manager";

export interface SessionData {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "ccu_campus_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
