import { Composition, Still } from 'remotion';
import { Tutorial, TutorialPoster } from './Tutorial';

export const FPS = 30;
export const TUTORIAL_DURATION = 1380;

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Tutorial"
        component={Tutorial}
        durationInFrames={TUTORIAL_DURATION}
        fps={FPS}
        width={1280}
        height={720}
      />
      <Still id="TutorialPoster" component={TutorialPoster} width={1280} height={720} />
    </>
  );
}
