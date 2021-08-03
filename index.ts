import {
  Fish as Twin,
  FishId as TwinId,
  Pond as Actyx,
  Tags,
} from '@actyx/pond';
interface CoinState {
  heads: boolean;
}

interface TossEvent {
  heads: boolean;
}

function emitCoinToss(pond: Actyx, heads: boolean) {
  pond.emit(Tags<TossEvent>('toss'), {
    heads: heads,
  });
}

export const CoinTwin: Twin<CoinState, TossEvent> = {
  fishId: TwinId.of('coin', 'quarter', 0),
  initialState: { heads: false },
  where: Tags<TossEvent>('toss'),
  onEvent: (state, event) => {
    return { ...state, heads: event.heads };
  },
};

async function runCoinToss(pond: Actyx) {
  pond.observe(CoinTwin, (state) => {
    setTimeout(() => {
      emitCoinToss(pond, Boolean(Math.random() < 0.5));
      console.log(
        new Date().toISOString() + ': Coin toss state: ' + JSON.stringify(state)
      );
    }, 2_000);
  });
}

(async () => {
  const actyx = await Actyx.default({
    appId: 'com.example.app',
    displayName: 'My Demo',
    version: '1.0.0',
  });

  const program = process.argv[2];
  if (program === 'cointoss') {
    await runCoinToss(actyx);
  } else {
    console.log(`please set which program to run`);
    process.exit(1);
  }
})();
