import { Subscription } from "rxjs";

export interface ShareState {
  userMouseList: UserMouse[];
}

export interface UserMouse {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  _subscription: Subscription;
}

export function createShareState(): ShareState {
  return {
    userMouseList: [],
  };
}
