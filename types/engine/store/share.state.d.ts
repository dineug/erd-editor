export interface ShareState {
  userMouses: UserMouse[];
}

export interface UserMouse {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  timerId: number;
}
