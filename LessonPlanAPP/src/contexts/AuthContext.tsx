import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { cloudAuthService } from "../services/cloudAuthService";
import { mockAuthService } from "../services/mockAuthService";
import { AuthMode, Permission, SignUpProfileInput, UserProfile } from "../types/user";
import { hasPermission } from "../services/permissions";
import { profilePhotoService } from "../services/profilePhotoService";

interface AuthContextValue {
  currentUser: UserProfile | null;
  users: UserProfile[];
  authMode: AuthMode;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (profile: SignUpProfileInput) => Promise<void>;
  resetPassword: (email: string) => Promise<string | void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  changeEmail: (nextEmail: string, currentPassword: string) => Promise<void>;
  setUserPassword: (id: string, nextPassword?: string) => Promise<string | void>;
  signOut: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState(() => profilePhotoService.applyAll(mockAuthService.listUsers()));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(cloudAuthService.enabled);
  const authMode: AuthMode = cloudAuthService.enabled ? "cloud" : "local";

  const refreshUsers = async () => {
    const nextUsers = profilePhotoService.applyAll(cloudAuthService.enabled ? await cloudAuthService.listUsers().catch(() => []) : mockAuthService.listUsers());
    setUsers(nextUsers);
    return nextUsers;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!cloudAuthService.enabled) {
        mockAuthService.signOut();
        return;
      }
      cloudAuthService.clearSession();
      setLoading(true);
      try {
        const nextUsers = profilePhotoService.applyAll(await cloudAuthService.listUsers().catch(() => []));
        if (!mounted) return;
        setCurrentUser(null);
        setUsers(nextUsers);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const user = cloudAuthService.enabled ? await cloudAuthService.signIn(email, password) : mockAuthService.signIn(email, password);
    setCurrentUser(profilePhotoService.apply(user));
    await refreshUsers();
  };

  const signUp = async (profile: SignUpProfileInput) => {
    if (cloudAuthService.enabled) {
      await cloudAuthService.signUp(profile);
    } else {
      mockAuthService.signUp(profile);
    }
    await refreshUsers();
  };

  const resetPassword = async (email: string) => {
    if (cloudAuthService.enabled) {
      await cloudAuthService.resetPassword(email);
      return;
    }
    return mockAuthService.resetPassword(email);
  };

  const changePassword = async (currentPassword: string, nextPassword: string) => {
    if (cloudAuthService.enabled) {
      await cloudAuthService.changePassword(currentPassword, nextPassword);
      return;
    }
    if (!currentUser) throw new Error("A signed-in user is required.");
    mockAuthService.changePassword(currentUser.id, currentPassword, nextPassword);
  };

  const changeEmail = async (nextEmail: string, currentPassword: string) => {
    if (cloudAuthService.enabled) {
      await cloudAuthService.changeEmail(nextEmail, currentPassword);
      await signOut();
      return;
    }
    if (!currentUser) throw new Error("A signed-in user is required.");
    mockAuthService.updateProfile({ ...currentUser, email: nextEmail.trim().toLowerCase() });
    await signOut();
  };

  const setUserPassword = async (id: string, nextPassword?: string) => {
    if (cloudAuthService.enabled) {
      const user = users.find((item) => item.id === id);
      if (!user) throw new Error("User profile not found.");
      return cloudAuthService.createRecoveryPassword(user.email, nextPassword);
    }
    return mockAuthService.setUserPassword(id, nextPassword);
  };

  const signOut = async () => {
    if (cloudAuthService.enabled) {
      await cloudAuthService.signOut();
    } else {
      mockAuthService.signOut();
    }
    setCurrentUser(null);
  };

  const updateProfile = async (profile: UserProfile) => {
    if (!cloudAuthService.enabled) {
      if (profile.photoUrl) {
        profilePhotoService.set(profile.id, profile.photoUrl);
      } else {
        profilePhotoService.remove(profile.id);
      }
    }
    const next = cloudAuthService.enabled ? await cloudAuthService.updateProfile(profile) : mockAuthService.updateProfile(profile);
    const nextWithPhoto = profilePhotoService.apply(next);
    await refreshUsers();
    setCurrentUser((current) => (current?.id === next.id ? nextWithPhoto : current));
  };

  const deleteUser = async (id: string) => {
    if (cloudAuthService.enabled) {
      await cloudAuthService.deleteUser(id);
    } else {
      mockAuthService.deleteUser(id);
    }
    await refreshUsers();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      users,
      authMode,
      loading,
      signIn,
      signUp,
      resetPassword,
      changePassword,
      changeEmail,
      setUserPassword,
      signOut,
      updateProfile,
      deleteUser,
      can: (permission) => hasPermission(currentUser, permission)
    }),
    [currentUser, users, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
