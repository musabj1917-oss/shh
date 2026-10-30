import React,{act} from 'react';
import renderer from 'react-test-renderer';
import {BrandMark} from '../src/components/UI';

test('brand mark renders Haiku lettermark',async()=>{
 let tree:ReturnType<typeof renderer.create>|undefined;
 await act(async()=>{tree=renderer.create(<BrandMark/>);});
 expect(tree?.toJSON()).toBeTruthy();
 expect(tree?.toJSON()).toMatchObject({type:'View'});
 await act(async()=>{tree?.unmount();});
});
