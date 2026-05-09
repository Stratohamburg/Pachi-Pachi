import type { RewardChoice } from '../../core/types/game.types';
import type { ObstacleConfig } from '../../core/types/content.types';
import type { BattleCatalog } from './battle.types';

type PlacementObstacle = ObstacleConfig & {
  type: 'BLOCKER_GLASS' | 'BUMPER_ELASTIC' | 'PIN_BASIC';
};

interface RewardChoiceParams {
  catalog: BattleCatalog;
  ownedRelicIds: number[];
  unlockedBallIds: number[];
}

export function createRewardChoices(params: RewardChoiceParams): RewardChoice[] {
  const { catalog, ownedRelicIds, unlockedBallIds } = params;
  const ballPool = shuffle(catalog.allBalls.filter((ball) => !unlockedBallIds.includes(ball.id)));
  const relicPool = shuffle(catalog.allRelics.filter((relic) => !ownedRelicIds.includes(relic.id)));
  const placementPool = shuffle(catalog.placementObstacles.filter(isPlacementObstacle));

  const choices: RewardChoice[] = [];

  if (ballPool[0]) {
    choices.push({
      id: `ball-${ballPool[0].id}`,
      kind: 'ball',
      title: ballPool[0].name,
      description: ballPool[0].desc,
      rarity: ballPool[0].rarity,
      ball: ballPool[0],
    });
  }

  if (relicPool[0]) {
    choices.push({
      id: `relic-${relicPool[0].id}`,
      kind: 'relic',
      title: relicPool[0].title,
      description: relicPool[0].desc,
      rarity: relicPool[0].tier,
      relic: relicPool[0],
    });
  }

  if (placementPool[0]) {
    choices.push({
      id: `placement-${placementPool[0].id}`,
      kind: 'placement',
      title: placementTitle(placementPool[0].type),
      description: placementPool[0].desc,
      rarity: placementRarity(placementPool[0].type),
      obstacle: placementPool[0],
    });
  }

  if (choices.length < 3) {
    const overflowChoices = shuffle([
      ...ballPool.slice(1).map<RewardChoice>((ball) => ({
        id: `ball-${ball.id}`,
        kind: 'ball',
        title: ball.name,
        description: ball.desc,
        rarity: ball.rarity,
        ball,
      })),
      ...relicPool.slice(1).map<RewardChoice>((relic) => ({
        id: `relic-${relic.id}`,
        kind: 'relic',
        title: relic.title,
        description: relic.desc,
        rarity: relic.tier,
        relic,
      })),
      ...placementPool.slice(1).map<RewardChoice>((obstacle) => ({
        id: `placement-${obstacle.id}`,
        kind: 'placement',
        title: placementTitle(obstacle.type),
        description: obstacle.desc,
        rarity: placementRarity(obstacle.type),
        obstacle,
      })),
    ]);

    for (const choice of overflowChoices) {
      if (choices.length >= 3) {
        break;
      }

      if (!choices.some((existingChoice) => existingChoice.id === choice.id)) {
        choices.push(choice);
      }
    }
  }

  return choices.slice(0, 3);
}

function placementTitle(type: 'BLOCKER_GLASS' | 'BUMPER_ELASTIC' | 'PIN_BASIC') {
  switch (type) {
    case 'BUMPER_ELASTIC':
      return '高弹力柱套件';
    case 'BLOCKER_GLASS':
      return '玻璃折线路障';
    case 'PIN_BASIC':
      return '追加金属钉';
  }
}

function placementRarity(type: 'BLOCKER_GLASS' | 'BUMPER_ELASTIC' | 'PIN_BASIC') {
  switch (type) {
    case 'BUMPER_ELASTIC':
      return 2;
    case 'BLOCKER_GLASS':
      return 3;
    case 'PIN_BASIC':
      return 1;
  }
}

function shuffle<TValue>(values: TValue[]): TValue[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function isPlacementObstacle(obstacle: ObstacleConfig): obstacle is PlacementObstacle {
  return obstacle.type === 'PIN_BASIC' || obstacle.type === 'BUMPER_ELASTIC' || obstacle.type === 'BLOCKER_GLASS';
}