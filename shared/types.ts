export interface Boyfriend {
  id: string;
  name: string;
  points: number;
  createdAt: string;
}

export interface PointEvent {
  id: string;
  boyfriendId: string;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface BoyfriendWithHistory extends Boyfriend {
  history: PointEvent[];
}
