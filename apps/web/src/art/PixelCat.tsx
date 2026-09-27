import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function PixelCat({ type }: { type: CardType }) {
  return <CardScene type={type} style="pixel" cat={<CatActor type={type} style="pixel"/>}/>;
}
