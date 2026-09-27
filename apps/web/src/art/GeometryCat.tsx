import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function GeometryCat({ type }: { type: CardType }) {
  return <CardScene type={type} style="geometry" cat={<CatActor type={type} style="geometry"/>}/>;
}
