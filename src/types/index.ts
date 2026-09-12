export interface TennisSidePlayer {
  id: string;
  name: string;
  shortName: string;
  country: string;
  color: string;
}

export interface TennisFixture {
  id: string;
  homeTeam: TennisSidePlayer;
  awayTeam: TennisSidePlayer;
  competition: string;
  competitionShort: string;
  time: string;
  status: 'live' | 'upcoming' | 'replay';
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  isLive?: boolean;
  isActive?: boolean;
}
