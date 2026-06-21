
    export type RemoteKeys = 'matchCenter/App';
    type PackageType<T> = T extends 'matchCenter/App' ? typeof import('matchCenter/App') :any;