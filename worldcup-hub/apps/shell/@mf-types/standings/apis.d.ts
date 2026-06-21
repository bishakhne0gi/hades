
    export type RemoteKeys = 'standings/App';
    type PackageType<T> = T extends 'standings/App' ? typeof import('standings/App') :any;