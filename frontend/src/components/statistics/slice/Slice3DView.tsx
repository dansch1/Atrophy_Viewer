import type { Box } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewer } from "@/context/ViewerStateProvider";
import type { SlicePosition } from "@/lib/dicom";
import { dot, mid } from "@/lib/vec2";
import { Bounds, GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { useMemo } from "react";
import * as THREE from "three";

const Slice3DView: React.FC = () => {
	const { selectedVolume, hiddenClasses, processedVolumeResult, selectedModelColors } = useViewer();

	const data = useMemo(() => {
		if (!selectedVolume) {
			return null;
		}

		if (!processedVolumeResult || processedVolumeResult.scope !== "slice") {
			return [];
		}

		return processedVolumeResult.items.map((prediction, sliceIndex) => {
			const z = computeSliceZ(selectedVolume.slicePositions, sliceIndex);
			if (prediction?.kind !== "object_detection") {
				return {
					z,
					items: [],
				};
			}

			return {
				z,
				items: prediction.boxes.map((box, detectionIndex) => ({
					box,
					cls: prediction.classes[detectionIndex],
					key: `prediction-${sliceIndex}-${detectionIndex}`,
				})),
			};
		});
	}, [selectedVolume, processedVolumeResult]);

	function computeSliceZ(slicePositions: SlicePosition[], sliceIndex: number): number {
		const first = mid(slicePositions[0].p0, slicePositions[0].p1);
		const last = mid(slicePositions[slicePositions.length - 1].p0, slicePositions[slicePositions.length - 1].p1);

		let dx = last.x - first.x;
		let dy = last.y - first.y;
		const length = Math.hypot(dx, dy) || 1;
		dx /= length;
		dy /= length;

		const current = mid(slicePositions[sliceIndex].p0, slicePositions[sliceIndex].p1);
		return dot(current.x - first.x, current.y - first.y, dx, dy);
	}

	const LesionBoxMesh: React.FC<{
		box: Box;
		cols: number;
		rows: number;
		color: string;
	}> = ({ box, cols, rows, color }) => {
		const shape = useMemo(() => getBoxShape(box, cols, rows), [box, cols, rows]);

		return (
			<mesh>
				<shapeGeometry args={[shape]} />
				<meshStandardMaterial
					color={color}
					transparent
					opacity={0.45}
					side={THREE.DoubleSide}
					depthWrite={false}
				/>
			</mesh>
		);
	};

	function getBoxShape(box: Box, cols: number, rows: number): THREE.Shape {
		const [x1, y1, x2, y2] = box;

		const p1 = pointToWorld(x1, y1, cols, rows);
		const p2 = pointToWorld(x2, y2, cols, rows);

		const left = Math.min(p1.x, p2.x);
		const right = Math.max(p1.x, p2.x);
		const top = Math.max(p1.y, p2.y);
		const bottom = Math.min(p1.y, p2.y);

		const shape = new THREE.Shape();
		shape.moveTo(left, top);
		shape.lineTo(right, top);
		shape.lineTo(right, bottom);
		shape.lineTo(left, bottom);
		shape.closePath();
		return shape;
	}

	function pointToWorld(x: number, y: number, cols: number, rows: number): THREE.Vector2 {
		const cx = (cols - 1) / 2;
		const cy = (rows - 1) / 2;

		return new THREE.Vector2(cx - x, cy - y);
	}

	if (!data || !selectedVolume) {
		return null;
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>3D Lesions</CardTitle>
			</CardHeader>

			<CardContent>
				<div className="h-[500px] bg-secondary">
					<Canvas className="w-full h-full" camera={{ position: [0, 0, 6], fov: 45 }}>
						<ambientLight intensity={0.6} />
						<directionalLight position={[6, 10, 6]} intensity={0.8} />

						<Bounds fit clip margin={1.2}>
							<group>
								{data.map((slice, i) => (
									<group key={`lesion-${i}`} position={[0, 0, slice.z]}>
										{slice.items
											.filter((it) => !hiddenClasses.has(it.cls))
											.map((it) => (
												<LesionBoxMesh
													key={it.key}
													box={it.box}
													cols={selectedVolume.cols}
													rows={selectedVolume.rows}
													color={selectedModelColors.getColorByIndex(it.cls)}
												/>
											))}
									</group>
								))}
							</group>
						</Bounds>

						<OrbitControls makeDefault enableDamping dampingFactor={0.08} />
						<GizmoHelper>
							<GizmoViewport />
						</GizmoHelper>
					</Canvas>
				</div>
			</CardContent>
		</Card>
	);
};

export default Slice3DView;
