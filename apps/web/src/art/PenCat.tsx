import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function PenCat({ type }: { type: CardType }) {
  return <CardScene type={type} style="pen" cat={<CatActor type={type} style="pen"/>}/>;
}
