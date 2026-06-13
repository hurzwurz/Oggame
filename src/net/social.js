// Soziale Features: Allianzen/Gilden und Freundschaften (über Supabase).

import { getClient } from './supabase.js';

async function need() {
  const sb = await getClient();
  if (!sb) throw new Error('Offline – nicht mit dem Server verbunden.');
  return sb;
}

// ----------------------------------------------------------- Profile / Suche

export async function searchProfiles(q) {
  const sb = await need();
  const { data, error } = await sb
    .from('profiles')
    .select('id,username,points')
    .ilike('username', `%${q}%`)
    .limit(20);
  if (error) throw error;
  return data || [];
}

// ------------------------------------------------------------------ Allianzen

/** Mitgliedschaft des Nutzers (oder null). */
export async function myMembership(userId) {
  const sb = await need();
  const { data, error } = await sb
    .from('alliance_members')
    .select('alliance_id, role, alliances(name, tag, founder)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAlliances() {
  const sb = await need();
  const { data, error } = await sb
    .from('alliances')
    .select('id, name, tag, founder')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function allianceMembers(allianceId) {
  const sb = await need();
  const { data, error } = await sb
    .from('alliance_members')
    .select('user_id, role, profiles(username, points)')
    .eq('alliance_id', allianceId);
  if (error) throw error;
  return data || [];
}

export async function createAlliance(userId, name, tag) {
  const sb = await need();
  const { data, error } = await sb
    .from('alliances')
    .insert({ name: name.trim(), tag: tag.trim(), founder: userId })
    .select()
    .single();
  if (error) throw error;
  const { error: e2 } = await sb
    .from('alliance_members')
    .insert({ alliance_id: data.id, user_id: userId, role: 'founder' });
  if (e2) throw e2;
  return data;
}

export async function joinAlliance(userId, allianceId) {
  const sb = await need();
  const { error } = await sb
    .from('alliance_members')
    .insert({ alliance_id: allianceId, user_id: userId, role: 'member' });
  if (error) throw error;
}

export async function leaveAlliance(userId, allianceId) {
  const sb = await need();
  const { error } = await sb
    .from('alliance_members')
    .delete()
    .eq('user_id', userId)
    .eq('alliance_id', allianceId);
  if (error) throw error;
}

// ------------------------------------------------------------------ Freunde

/** Liefert alle Freundschaften des Nutzers (akzeptiert + offen). */
export async function listFriends(userId) {
  const sb = await need();
  const { data, error } = await sb
    .from('friendships')
    .select('id, requester, addressee, status')
    .or(`requester.eq.${userId},addressee.eq.${userId}`);
  if (error) throw error;
  const rows = data || [];
  const ids = [...new Set(rows.flatMap((r) => [r.requester, r.addressee]))].filter((x) => x !== userId);
  const names = {};
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, username').in('id', ids);
    for (const p of profs || []) names[p.id] = p.username;
  }
  return rows.map((r) => {
    const other = r.requester === userId ? r.addressee : r.requester;
    return {
      id: r.id,
      status: r.status,
      otherName: names[other] || '?',
      incoming: r.addressee === userId, // an mich gerichtet
      outgoing: r.requester === userId, // von mir gesendet
    };
  });
}

export async function sendFriendRequest(userId, username) {
  const sb = await need();
  const { data: prof, error: e0 } = await sb
    .from('profiles')
    .select('id')
    .eq('username', username.trim())
    .maybeSingle();
  if (e0) throw e0;
  if (!prof) throw new Error('Spieler nicht gefunden.');
  if (prof.id === userId) throw new Error('Du kannst dir nicht selbst eine Anfrage senden.');
  const { error } = await sb
    .from('friendships')
    .insert({ requester: userId, addressee: prof.id, status: 'pending' });
  if (error) throw error;
}

export async function respondFriend(id, accept) {
  const sb = await need();
  if (accept) {
    const { error } = await sb.from('friendships').update({ status: 'accepted' }).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('friendships').delete().eq('id', id);
    if (error) throw error;
  }
}

export async function removeFriend(id) {
  const sb = await need();
  const { error } = await sb.from('friendships').delete().eq('id', id);
  if (error) throw error;
}

/** Eigenes Profil (Name, Punkte). */
export async function getProfile(userId) {
  const sb = await need();
  const { data, error } = await sb.from('profiles').select('username, points').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Spielernamen ändern. */
export async function updateUsername(userId, name) {
  const sb = await need();
  const { error } = await sb.from('profiles').update({ username: name.trim() }).eq('id', userId);
  if (error) throw error;
}

// ------------------------------------------------------------ Allianz-Chat & Rangliste

export async function allianceMessages(allianceId) {
  const sb = await need();
  const { data, error } = await sb
    .from('alliance_messages')
    .select('id, sender_name, body, created_at')
    .eq('alliance_id', allianceId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).reverse();
}

export async function sendAllianceMessage(allianceId, senderId, senderName, body) {
  const sb = await need();
  const { error } = await sb
    .from('alliance_messages')
    .insert({ alliance_id: allianceId, sender: senderId, sender_name: senderName, body });
  if (error) throw error;
}

export async function allianceRanking() {
  const sb = await need();
  const { data, error } = await sb.from('alliance_ranking').select('*').limit(50);
  if (error) throw error;
  return data || [];
}
