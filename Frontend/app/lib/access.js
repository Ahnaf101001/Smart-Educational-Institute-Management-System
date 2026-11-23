"use client";

import { createContext, useContext } from "react";

// UI-side permission check. The server enforces every permission as well
//.
export function can(user, module, action = "view") {
  if (!user) return false;
  if (user.isAdmin) return true;
  const actions = user.matrix?.[module];
  return Array.isArray(actions) && actions.includes(action);
}

export function canAny(user, pairs) {
  return pairs.some(([m, a]) => can(user, m, a || "view"));
}

export const UserContext = createContext({ user: null, settings: {}, profile: {} });
export function useUser() {
  return useContext(UserContext);
}
