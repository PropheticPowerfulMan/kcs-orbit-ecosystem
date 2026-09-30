const key = "powerful-lesson-planner:profile-photos";

const read = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

const write = (photos: Record<string, string>) => localStorage.setItem(key, JSON.stringify(photos));

export const profilePhotoService = {
  get(userId: string) {
    return read()[userId] || "";
  },
  set(userId: string, photoUrl: string) {
    write({ ...read(), [userId]: photoUrl });
  },
  remove(userId: string) {
    const photos = read();
    delete photos[userId];
    write(photos);
  },
  apply<T extends { id: string; photoUrl?: string }>(profile: T): T {
    return { ...profile, photoUrl: profile.photoUrl || this.get(profile.id) || "" };
  },
  applyAll<T extends { id: string; photoUrl?: string }>(profiles: T[]): T[] {
    return profiles.map((profile) => this.apply(profile));
  }
};
