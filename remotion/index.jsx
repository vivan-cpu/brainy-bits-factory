import React from 'react';
import {registerRoot, Composition} from 'remotion';
import {Video, durationFor} from './Video.jsx';
import {LongVideo} from './LongVideo.jsx';
import sample from '../data/sample-props.json';

const Root = () => (
  <>
    <Composition
      id="Brainy"
      component={Video}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={300}
      defaultProps={sample}
      calculateMetadata={({props}) => ({durationInFrames: durationFor(props.timing)})}
    />
    <Composition
      id="BrainyLong"
      component={LongVideo}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={sample}
      calculateMetadata={({props}) => ({durationInFrames: durationFor(props.timing)})}
    />
  </>
);

registerRoot(Root);
