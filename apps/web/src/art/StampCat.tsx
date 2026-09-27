import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function StampCat({ type }: { type: CardType }) {
  return <CardScene type={type} style="stamp" cat={<CatActor type={type} style="stamp"/>}/>;
}
