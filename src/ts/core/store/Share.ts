export interface ShareState {
  userMouseList: UserMouse[];
}

export interface UserMouse {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  _timeoutID: any;
}

export function createShareState(): ShareState {
  return {
    userMouseList: [],
  };
}
