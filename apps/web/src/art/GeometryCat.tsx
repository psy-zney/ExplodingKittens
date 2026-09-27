import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function GeometryCat({ type, variant=0 }: { type: CardType; variant?:number }) {
  return <CardScene type={type} style="geometry" cat={<CatActor type={type} style="geometry" variant={variant}/>}/>;
}
