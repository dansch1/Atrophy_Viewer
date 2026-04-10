import type { Box, Contour, Contours } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewer } from "@/context/ViewerStateProvider";
import { hasValidContours, isValidContour } from "@/lib/contours";
import type { SlicePosition } from "@/lib/dicom";
import { dot, mid } from "@/lib/vec2";
import { Bounds, GizmoHelper, GizmoViewport, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { useMemo } from "react";
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
				contours: sp.contours?.[j] ?? null,
				key: `prediction-${i}-${j}`,
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

	const LesionPrediction: React.FC<{
		box: Box;
		contours: Contours | null;
		cols: number;
		rows: number;
		color: string;
	}> = ({ box, contours, cols, rows, color }) => {
		return hasValidContours(contours) ? (
			<LesionContourLines contours={contours} cols={cols} rows={rows} color={color} />
		) : (
			<LesionBoxMesh box={box} cols={cols} rows={rows} color={color} />
		);
	};

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

	const LesionContourLines: React.FC<{
		contours: Contours;
		cols: number;
		rows: number;
		color: string;
	}> = ({ contours, cols, rows, color }) => {
		const lines = useMemo(
			() => contours.filter(isValidContour).map((contour) => contourToWorld(contour, cols, rows)),
			[contours, cols, rows],
		);

		if (!lines.length) {
			return null;
		}

		return (
			<group>
				{lines.map((points, i) => (
					<Line key={`contour-${i}`} points={points} color={color} transparent opacity={0.95} />
				))}
			</group>
		);
	};

	function contourToWorld(contour: Contour, cols: number, rows: number): THREE.Vector2[] {
		if (contour.length < 3) {
			return [];
		}

		const points = contour.map(([x, y]) => {
			const p = pointToWorld(x, y, cols, rows);
			return new THREE.Vector2(p.x, p.y);
		});

		points.push(points[0].clone());
		return points;
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
										<group key={`lesion-${i}`} position={[0, 0, slice.z]}>
											{slice.items
												.filter((it) => !hiddenLabels.has(it.cls))
												.map((it) => (
													<LesionPrediction
														key={it.key}
														box={it.box}
														contours={it.contours}
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
