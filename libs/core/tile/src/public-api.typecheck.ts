import type * as TilePublicApi from './index';

// @ts-expect-error MlvTileSize must not be exported from the public Tile API.
type _RemovedTileSize = TilePublicApi.MlvTileSize;
