export type Role = 'wife' | 'boyfriend';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  color: string;
  avatarUrl?: string;
  partnerId?: string;
  friendIds: string[];
  points: number;
  token?: string;
  onboarded: boolean;
  demo?: boolean;
  createdAt: string;
}

/** User shape returned to clients (no secrets). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  color: string;
  avatarUrl?: string;
  partnerId?: string;
  partnerName?: string;
  partnerColor?: string;
  partnerAvatar?: string;
  friendIds: string[];
  points: number;
  onboarded: boolean;
  demo?: boolean;
}

export interface Prize {
  id: string;
  wifeId: string;
  title: string;
  emoji: string;
  cost: number;
  createdAt: string;
}

export interface EarnTask {
  id: string;
  wifeId: string;
  title: string;
  emoji: string;
  points: number;
  createdAt: string;
}

export type SubmissionStatus = 'pending' | 'approved' | 'denied';

export interface Submission {
  id: string;
  boyfriendId: string;
  wifeId: string;
  title: string;
  emoji: string;
  points: number;
  requestedPoints: number;
  note: string;
  images: string[];
  status: SubmissionStatus;
  revised: boolean;
  /** When true, approval posts this win to the social feed (Venmo-style). */
  shared: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export type RedemptionStatus = 'pending' | 'fulfilled';

export interface Redemption {
  id: string;
  boyfriendId: string;
  wifeId: string;
  prizeTitle: string;
  emoji: string;
  cost: number;
  status: RedemptionStatus;
  /** When true, this redemption appears on the social feed (Venmo-style). */
  shared: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export type FeedType = 'earn' | 'redeem';

export interface FeedReaction {
  emoji: string;
  userId: string;
}

export interface FeedComment {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
}

export interface FeedEvent {
  id: string;
  type: FeedType;
  boyfriendId: string;
  wifeId: string;
  title: string;
  emoji: string;
  points: number;
  note: string;
  images: string[];
  likes: string[];
  reactions: FeedReaction[];
  comments: FeedComment[];
  createdAt: string;
}

/** Feed row enriched with display names for the client. */
export interface FeedEventView extends FeedEvent {
  boyfriendName: string;
  boyfriendColor: string;
  boyfriendAvatar?: string;
  wifeName: string;
  likedByMe: boolean;
}

export interface Suggestion {
  title: string;
  emoji: string;
  points: number;
}

export type NotificationKind =
  | 'request'
  | 'approved'
  | 'denied'
  | 'redeem'
  | 'reaction'
  | 'comment'
  | 'prize';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  emoji: string;
  title: string;
  body?: string;
  points?: number;
  actorName?: string;
  actorColor?: string;
  actorAvatar?: string;
  createdAt: string;
}
