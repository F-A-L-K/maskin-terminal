import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, PerspectiveCamera } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import * as THREE from 'three';

function Model({ 
  url, 
  isPlaying, 
  onAnimationComplete
}: { 
  url: string; 
  isPlaying: boolean;
  onAnimationComplete?: () => void;
}) {
  const { scene, animations } = useGLTF(url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const stepAnimationsRef = useRef<{ name: string; action: THREE.AnimationAction; stepNumber: number }[]>([]);
  const stepGroupsRef = useRef<Map<number, THREE.AnimationAction[]>>(new Map());
  const currentStepIndexRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);

  // Keep refs in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Initialize animations and sort steps
  useEffect(() => {
    if (animations && animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene);
      mixerRef.current = mixer;

      // Find and group step animations by step number
      const stepGroups = new Map<number, { name: string; clip: THREE.AnimationClip }[]>();
      
      animations.forEach((clip) => {
        const name = clip.name;
        const nameLower = name.toLowerCase();
        // Check for "Step" or "step" (case insensitive)
        if (nameLower.startsWith('step')) {
          // Extract step number (e.g., "Step1" -> 1, "step2" -> 2)
          const match = nameLower.match(/step(\d+)/);
          if (match) {
            const stepNumber = parseInt(match[1], 10);
            if (!stepGroups.has(stepNumber)) {
              stepGroups.set(stepNumber, []);
            }
            stepGroups.get(stepNumber)!.push({ name: clip.name, clip });
          }
        }
      });

      // Create actions for all animations
      const actionsMap = new Map<string, THREE.AnimationAction>();
      animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        actionsMap.set(clip.name, action);
      });
      actionsRef.current = actionsMap;

      // Store step animations grouped by step number, sorted
      const sortedSteps = Array.from(stepGroups.keys()).sort((a, b) => a - b);
      const stepGroupsMap = new Map<number, THREE.AnimationAction[]>();
      
      sortedSteps.forEach(stepNumber => {
        const clips = stepGroups.get(stepNumber)!;
        const actions = clips.map(({ name }) => actionsMap.get(name)!);
        stepGroupsMap.set(stepNumber, actions);
      });
      
      stepGroupsRef.current = stepGroupsMap;
      
      // Also store flat list for compatibility
      stepAnimationsRef.current = sortedSteps.flatMap(stepNumber => {
        const clips = stepGroups.get(stepNumber)!;
        return clips.map(({ name }) => ({
          name,
          action: actionsMap.get(name)!,
          stepNumber
        }));
      });

      // Debug: log found animations
      console.log('Found animations:', animations.map(a => a.name));
      console.log('Step groups:', Array.from(stepGroups.entries()));
      console.log('Step groups map:', Array.from(stepGroupsMap.keys()));

      return () => {
        actionsMap.forEach(action => action.stop());
        mixer.uncacheRoot(scene);
      };
    }
  }, [scene, animations]);

  // Control play/pause and step through animations
  useEffect(() => {
    if (mixerRef.current && stepGroupsRef.current.size > 0) {
      if (isPlaying) {
        // Reset to first step
        currentStepIndexRef.current = 0;
        
        // Stop all animations first
        stepGroupsRef.current.forEach(actions => {
          actions.forEach(action => {
            action.stop();
            action.reset();
          });
        });

        // Start first step (all animations in step 1)
        const sortedStepNumbers = Array.from(stepGroupsRef.current.keys()).sort((a, b) => a - b);
        if (sortedStepNumbers.length > 0) {
          const firstStepNumber = sortedStepNumbers[0];
          const firstStepActions = stepGroupsRef.current.get(firstStepNumber);
          if (firstStepActions) {
            firstStepActions.forEach(action => {
              action.reset();
              action.play();
            });
          }
        }
      } else {
        // Pause all current step animations
        const sortedStepNumbers = Array.from(stepGroupsRef.current.keys()).sort((a, b) => a - b);
        if (sortedStepNumbers[currentStepIndexRef.current] !== undefined) {
          const currentStepNumber = sortedStepNumbers[currentStepIndexRef.current];
          const currentStepActions = stepGroupsRef.current.get(currentStepNumber);
          if (currentStepActions) {
            currentStepActions.forEach(action => {
              action.paused = true;
            });
          }
        }
      }
    }
  }, [isPlaying]);

  useFrame((state, delta) => {
    if (mixerRef.current && stepGroupsRef.current.size > 0) {
      if (isPlayingRef.current) {
        // Update mixer when playing
        mixerRef.current.update(delta);

        // Get current step number
        const sortedStepNumbers = Array.from(stepGroupsRef.current.keys()).sort((a, b) => a - b);
        const currentStepNumber = sortedStepNumbers[currentStepIndexRef.current];
        
        if (currentStepNumber !== undefined) {
          const currentStepActions = stepGroupsRef.current.get(currentStepNumber);
          
          if (currentStepActions) {
            // Check if all animations in current step are completed
            const allCompleted = currentStepActions.every(action => {
              const clip = action.getClip();
              return action.time >= clip.duration;
            });
            
            if (allCompleted) {
              // Current step is complete, move to next step
              const nextIndex = currentStepIndexRef.current + 1;
              
              if (nextIndex < sortedStepNumbers.length) {
                // Start next step (all animations in that step)
                currentStepIndexRef.current = nextIndex;
                const nextStepNumber = sortedStepNumbers[nextIndex];
                const nextStepActions = stepGroupsRef.current.get(nextStepNumber);
                
                if (nextStepActions) {
                  nextStepActions.forEach(action => {
                    action.reset();
                    action.play();
                  });
                }
              } else {
                // All steps completed
                if (onAnimationComplete) {
                  onAnimationComplete();
                }
              }
            }
          }
        }
      }
    }
  });

  return <primitive object={scene} />;
}

// Camera controller component
function CameraController() {
  const controlsRef = useRef<any>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={0.3}
      maxDistance={1}
    />
  );
}

function Scene({ 
  isPlaying, 
  setIsPlaying
}: {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}) {
  const handleAnimationComplete = () => {
    setIsPlaying(false);
  };

  return (
    <>
      <PerspectiveCamera makeDefault position={[40, 50, 50]} fov={70} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model 
          url="/instruktioner/animation.glb" 
          isPlaying={isPlaying}
          onAnimationComplete={handleAnimationComplete}
        />
      </Suspense>
      <CameraController />
    </>
  );
}

export default function Instruktioner() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full">
      <div className="flex-1 relative bg-gray-100 min-h-0">
        <Canvas className="w-full h-full">
          <Scene
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
        </Canvas>
      </div>
      
      <div className="p-4 bg-white border-t">
        <div className="flex items-center justify-center">
          <Button
            variant="default"
            size="lg"
            onClick={handlePlayPause}
            title={isPlaying ? "Pausa" : "Spela"}
            className="px-8 py-6 text-lg"
          >
            {isPlaying ? (
              <>
                <Pause className="h-5 w-5 mr-2" />
                Pausa
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Spela
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

