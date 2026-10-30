import { query } from '../db.js';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string | null;
  bio: string | null;
  pronouns: string | null;
  location: string | null;
  profilePhotoUrl: string | null;
  birthdayMonthDay: string | null; // MM-DD format only
  createdAt: string;
}

export async function getUserProfile(targetUserId: string): Promise<UserProfile | null> {
  const rows = await query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    username: string | null;
    bio: string | null;
    pronouns: string | null;
    location: string | null;
    profile_photo_url: string | null;
    date_of_birth: string;
    created_at: string;
  }>(
    `SELECT id, email, first_name, last_name, username, bio, pronouns, location, profile_photo_url, date_of_birth, created_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [targetUserId]
  );

  if (rows.length === 0) return null;
  const user = rows[0];

  let birthdayMonthDay: string | null = null;
  if (user.date_of_birth) {
    const dob = new Date(user.date_of_birth);
    birthdayMonthDay = `${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    bio: user.bio,
    pronouns: user.pronouns,
    location: user.location,
    profilePhotoUrl: user.profile_photo_url,
    birthdayMonthDay,
    createdAt: user.created_at
  };
}

export async function updateProfile(
  userId: string,
  updates: {
    username?: string;
    bio?: string;
    pronouns?: string;
    location?: string;
    profilePhotoUrl?: string;
  }
) {
  if (updates.username) {
    // Check 30-day restriction
    const check = await query<{ username_last_changed_at: string | null }>(
      `SELECT username_last_changed_at FROM users WHERE id = $1`,
      [userId]
    );

    if (check.length > 0 && check[0].username_last_changed_at) {
      const lastChanged = new Date(check[0].username_last_changed_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (lastChanged > thirtyDaysAgo) {
        throw new Error('Username can only be changed once every 30 days.');
      }
    }

    // Check uniqueness
    const existing = await query(`SELECT id FROM users WHERE username = $1 AND id <> $2`, [updates.username, userId]);
    if (existing.length > 0) {
      throw new Error('Username is already taken.');
    }

    await query(
      `UPDATE users SET username = $1, username_last_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [updates.username, userId]
    );
  }

  if (updates.bio !== undefined) {
    await query(`UPDATE users SET bio = $1, updated_at = NOW() WHERE id = $2`, [updates.bio, userId]);
  }
  if (updates.pronouns !== undefined) {
    await query(`UPDATE users SET pronouns = $1, updated_at = NOW() WHERE id = $2`, [updates.pronouns, userId]);
  }
  if (updates.location !== undefined) {
    await query(`UPDATE users SET location = $1, updated_at = NOW() WHERE id = $2`, [updates.location, userId]);
  }
  if (updates.profilePhotoUrl !== undefined) {
    await query(`UPDATE users SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2`, [updates.profilePhotoUrl, userId]);
  }

  return getUserProfile(userId);
}

export async function getDiscoverPeople(currentUserId: string, limit: number = 20) {
  const rows = await query<{
    id: string;
    first_name: string;
    last_name: string;
    username: string | null;
    bio: string | null;
    profile_photo_url: string | null;
  }>(
    `SELECT u.id, u.first_name, u.last_name, u.username, u.bio, u.profile_photo_url
     FROM users u
     WHERE u.id <> $1
       AND u.deleted_at IS NULL
       AND u.id NOT IN (
         SELECT friend_id FROM friendships WHERE user_id = $1
         UNION
         SELECT user_id FROM friendships WHERE friend_id = $1
       )
       AND u.id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION
         SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
     ORDER BY RANDOM()
     LIMIT $2`,
    [currentUserId, limit]
  );

  return rows.map((u) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    bio: u.bio,
    profilePhotoUrl: u.profile_photo_url
  }));
}
