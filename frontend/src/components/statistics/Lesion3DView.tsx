import type { Box } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewer } from "@/context/ViewerStateProvider";
import type { SlicePosition } from "@/lib/dicom";
import React, { useMemo } from "react";

import { dot, mid } from "@/lib/vec2";
import { Bounds, GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

const Lesion3DView: React.FC = () => {
	const { selectedVolume, selectedModel, processedVolumePredictions, hiddenLabels, selectedModelColors } =
		useViewer();

	const data = useMemo(() => {
		if (!selectedVolume || !selectedModel) {
			return null;
		}

		if (!processedVolumePredictions) {
			return [];
		}

		return processedVolumePredictions.map((sp, i) => ({
			z: computeSliceZ(selectedVolume.slicePositions, i),
			items: sp.boxes.map((box, j) => ({
				box,
				cls: sp.classes[j],
				key: `box-${i}-${j}`,
			})),
		}));
	}, [selectedVolume, processedVolumePredictions]);

	function computeSliceZ(slicePositions: SlicePosition[], sliceIndex: number): number {
		const m0 = mid(slicePositions[0].p0, slicePositions[0].p1);
		const mLast = mid(slicePositions[slicePositions.length - 1].p0, slicePositions[slicePositions.length - 1].p1);

		let dx = mLast.x - m0.x;
		let dy = mLast.y - m0.y;
		const L = Math.hypot(dx, dy) || 1;
		dx /= L;
		dy /= L;

		const mi = mid(slicePositions[sliceIndex].p0, slicePositions[sliceIndex].p1);
		return dot(mi.x - m0.x, mi.y - m0.y, dx, dy);
	}

	const LesionMesh: React.FC<{
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

	function getBoxShape(box: Box, cols: number, rows: number) {
		const [x1, y1, x2, y2] = box;

		const cx = (cols - 1) / 2;
		const cy = (rows - 1) / 2;

		const left = cx - x1;
		const right = cx - x2;
		const top = -(y1 - cy);
		const bottom = -(y2 - cy);

		const shape = new THREE.Shape();
		shape.moveTo(left, top);
		shape.lineTo(right, top);
		shape.lineTo(right, bottom);
		shape.lineTo(left, bottom);
		shape.closePath();
		return shape;
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>3D Lesions</CardTitle>
			</CardHeader>

			{data && selectedVolume && (
				<CardContent>
					<div className="h-[500px] bg-secondary">
						<Canvas className="w-full h-full" camera={{ position: [0, 0, 6], fov: 45 }}>
							<ambientLight intensity={0.6} />
							<directionalLight position={[6, 10, 6]} intensity={0.8} />

							<Bounds fit clip margin={1.2}>
								<group>
									{data.map((slice, i) => (
										<group key={`slice-${i}`} position={[0, 0, slice.z]}>
											{slice.items
												.filter((it) => !hiddenLabels.has(it.cls))
												.map((it) => (
													<LesionMesh
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
			)}
		</Card>
	);
};

export default Lesion3DView;
