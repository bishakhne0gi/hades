
    export type RemoteKeys = 'scoreboard/App';
    type PackageType<T> = T extends 'scoreboard/App' ? typeof import('scoreboard/App') :any;