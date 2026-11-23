import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TREE_CONFIG } from "../config/treeConfig";
import type { TreeConfig } from "../config/treeConfig";

type SnowflakeState = {
    position: THREE.Vector3;
    fallSpeed: number;
    swaySpeed: number;
    swayOffset: number;
    tiltAxis: THREE.Vector3;
    tiltAngle: number;
    spinAngle: number;
    spinSpeed: number;
    scale: number;
};

/** 简单的雪花粒子系统，负责创建/更新/销毁飘落效果 */
export class SnowSystem {
    private snow: THREE.InstancedMesh | null;
    private readonly scene: THREE.Scene;
    private readonly config: TreeConfig;
    private readonly flakes: SnowflakeState[];
    private readonly dummy: THREE.Object3D;
    private readonly strawberrySystem: FallingStrawberrySystem;

    constructor(scene: THREE.Scene, config: TreeConfig = TREE_CONFIG) {
        this.scene = scene;
        this.config = config;
        this.snow = null;
        this.flakes = [];
        this.dummy = new THREE.Object3D();
        this.strawberrySystem = new FallingStrawberrySystem(scene, config);
    }

    /** 构建片状雪花网格，并添加到场景 */
    create() {
        const count = this.getResponsiveParticleCount(
            this.config.particles.snowCount
        );
        const geometry = this.createSnowflakeGeometry();
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            roughness: 0.95,
            metalness: 0.05,
        });

        this.snow = new THREE.InstancedMesh(geometry, material, count);
        this.snow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.snow);
        this.flakes.length = 0;

        for (let i = 0; i < count; i++) {
            const state: SnowflakeState = {
                position: this.randomSpawnPosition(),
                fallSpeed: Math.random() * 0.2 + 0.05,
                swaySpeed: Math.random() * 0.5 + 0.1,
                swayOffset: Math.random() * Math.PI * 2,
                tiltAxis: new THREE.Vector3(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ).normalize(),
                tiltAngle: Math.random() * Math.PI * 2,
                spinAngle: Math.random() * Math.PI * 2,
                spinSpeed: Math.random() * 2 + 0.5,
                scale: Math.random() * 0.7 + 0.4,
            };
            this.flakes.push(state);
            this.writeMatrix(i, state);
        }
        // 草莓独立于雪花：各自拥有网格、数量、运动状态和发光材质。
        this.strawberrySystem.create();
    }

    /** 基于随机速度更新雪花位置，制造飘落与旋转 */
    update(clock: THREE.Clock) {
        if (!this.snow) return;

        const dt = clock.getDelta();
        for (let i = 0; i < this.flakes.length; i++) {
            const flake = this.flakes[i]!;
            flake.position.y -= flake.fallSpeed;
            flake.position.x +=
                Math.sin(clock.elapsedTime * 1.5 + flake.swayOffset) *
                flake.swaySpeed *
                0.02;
            flake.position.z +=
                Math.cos(clock.elapsedTime * 1.2 + flake.swayOffset) *
                flake.swaySpeed *
                0.015;
            flake.spinAngle += flake.spinSpeed * dt;

            if (flake.position.y < -40) {
                flake.position.copy(this.randomSpawnPosition(true));
                flake.tiltAxis = new THREE.Vector3(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ).normalize();
                flake.tiltAngle = Math.random() * Math.PI * 2;
                flake.spinAngle = Math.random() * Math.PI * 2;
                flake.spinSpeed = Math.random() * 2 + 0.5;
                flake.scale = Math.random() * 0.7 + 0.4;
            }

            this.writeMatrix(i, flake);
        }
        this.snow.instanceMatrix.needsUpdate = true;
        this.strawberrySystem.update(clock);
    }

    dispose() {
        this.strawberrySystem.dispose();
        if (!this.snow) return;
        this.scene.remove(this.snow);
        this.snow.geometry.dispose();
        (this.snow.material as THREE.Material).dispose();
        this.snow.dispose();
        this.snow = null;
        this.flakes.length = 0;
    }

    private writeMatrix(index: number, flake: SnowflakeState) {
        if (!this.snow) return;
        const tiltQuat = new THREE.Quaternion().setFromAxisAngle(
            flake.tiltAxis,
            flake.tiltAngle
        );
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(tiltQuat);
        const spinQuat = new THREE.Quaternion().setFromAxisAngle(
            normal,
            flake.spinAngle
        );
        this.dummy.position.copy(flake.position);
        this.dummy.quaternion.copy(tiltQuat.multiply(spinQuat));
        this.dummy.scale.setScalar(flake.scale);
        this.dummy.updateMatrix();
        this.snow.setMatrixAt(index, this.dummy.matrix);
    }

    private createSnowflakeGeometry() {
        const shape = new THREE.Shape();
        const steps = 360;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const point = this.computeSnowflakePoint(angle);
            if (i === 0) shape.moveTo(point.x, point.y);
            else shape.lineTo(point.x, point.y);
        }
        return new THREE.ShapeGeometry(shape);
    }

    private computeSnowflakePoint(theta: number) {
        let pc = { x: theta, y: 0.25 };
        pc = this.fieldA(this.fieldB(pc, 5.0));
        return new THREE.Vector2(
            pc.y * Math.cos(pc.x),
            pc.y * Math.sin(pc.x)
        );
    }

    private fieldA(pc: { x: number; y: number }) {
        pc.y += 0.02 * Math.floor(Math.cos(pc.x * 6.0) * 5.0);
        pc.y += 0.01 * Math.floor(10.0 * Math.cos(pc.x * 30.0));
        pc.y += 0.5 * Math.cos(pc.y * 10.0);
        return pc;
    }

    private fieldB(pc: { x: number; y: number }, f: number) {
        pc.y += 0.1 * Math.cos(pc.y * 100.0 + 10.0);
        pc.y += 0.1 * Math.cos(pc.y * 20.0 + f);
        pc.y += 0.04 * Math.cos(pc.y * 10.0 + 10.0);
        return pc;
    }

    private randomSpawnPosition(reset = false) {
        const xSpread = 120;
        const zStart = 25;
        const zRange = 45;
        const yMin = reset ? 30 : -20;
        const yMax = reset ? 50 : 40;
        return new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(xSpread),
            THREE.MathUtils.randFloat(yMin, yMax),
            -(zStart + Math.random() * zRange)
        );
    }

    private getResponsiveParticleCount(base: number) {
        const perf = this.config.performance;
        if (!perf?.responsiveParticles) return base;
        if (typeof window === "undefined") return base;
        if (window.innerWidth >= perf.smallDeviceWidth) return base;
        const scale = perf.particleScale?.snow ?? 1;
        return Math.max(1, Math.floor(base * scale));
    }
}


// 第二套独立飘落系统：粉红发光草莓，不改变原有白色雪花的几何和运动。

type BerryState = {
    position: THREE.Vector3;
    fallSpeed: number;
    swaySpeed: number;
    swayOffset: number;
    tiltAxis: THREE.Vector3;
    tiltAngle: number;
    spinAngle: number;
    spinSpeed: number;
    scale: number;
};

/** 保留 SnowSystem 的名称和接口，让项目其余代码不用修改。 */
class FallingStrawberrySystem {
    private group: THREE.Group | null = null;
    private meshes: THREE.InstancedMesh[] = [];
    private readonly states: BerryState[] = [];
    private readonly dummy = new THREE.Object3D();
    private glows: THREE.InstancedMesh[] = [];
    private lastTickMs = 0;
    private glowMaterial: THREE.ShaderMaterial | null = null;
    private readonly scene: THREE.Scene;
    private readonly config: TreeConfig;

    constructor(scene: THREE.Scene, config: TreeConfig = TREE_CONFIG) {
        this.scene = scene;
        this.config = config;
    }

    create() {
        this.dispose();
        // 小草莓比雪花更大，因此减少数量以避免遮挡圣诞树并改善性能。
        // 草莓为立体物件，控制数量，避免过度遮挡圣诞树。
        const count = Math.min(110, Math.max(35, Math.floor(this.getResponsiveParticleCount(this.config.particles.snowCount) * 0.10)));
        const group = new THREE.Group();
        group.name = "IndependentFallingStrawberries";
        this.group = group;
        const parts: Array<[THREE.BufferGeometry, THREE.Material]> = [
            [this.createBerryGeometry(), new THREE.MeshStandardMaterial({color: 0xff476e, roughness: 0.35, metalness: 0.08, emissive: 0x6d1026, emissiveIntensity: 0.35})],
            [this.createLeafGeometry(), new THREE.MeshStandardMaterial({color: 0x2bb66d, side: THREE.DoubleSide, roughness: 0.8})],
            [this.createSeedGeometry(), new THREE.MeshStandardMaterial({color: 0xffe7aa, roughness: 0.4, emissive: 0x8f661e, emissiveIntensity: 0.22})],
            [this.createHighlightGeometry(), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false})],
        ];
        this.meshes = parts.map(([geometry, material]) => {
            const mesh = new THREE.InstancedMesh(geometry, material, count);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            group.add(mesh);
            return mesh;
        });
        // 粉红色柔光使用 GPU billboard：不论怎样旋转视角，光晕始终朝向摄像机。
        // instanceMatrix 决定位置和大小；而不是给每颗草莓创建高成本的 PointLight。
        const haloGeometry = new THREE.PlaneGeometry(1, 1);
        const phases = new Float32Array(count);
        for (let i = 0; i < count; i++) phases[i] = Math.random() * Math.PI * 2;
        haloGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
        const haloMaterial = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: {
                uStrength: { value: 0.58 }, // 草莓粉色光晕强度：0.35 柔和；0.85 更明显
                uTime: { value: 0 },
            },
            vertexShader: `
                attribute float aPhase;
                varying vec2 vUv;
                varying float vPhase;
                void main() {
                    vUv = uv;
                    vPhase = aPhase;
                    vec4 center = viewMatrix * modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                    float size = length(instanceMatrix[0].xyz);
                    // 用视图坐标中的平面偏移，让光晕一直面向摄像头。
                    gl_Position = projectionMatrix * (center + vec4(position.xy * size, 0.0, 0.0));
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying float vPhase;
                uniform float uStrength;
                uniform float uTime;
                void main() {
                    float r = length(vUv - vec2(0.5)) * 2.0;
                    float soft = exp(-5.0 * r * r) * (1.0 - smoothstep(0.75, 1.0, r));
                    float twinkle = 0.80 + 0.20 * sin(uTime * 2.4 + vPhase);
                    gl_FragColor = vec4(1.0, 0.38, 0.58, soft * uStrength * twinkle);
                }
            `,
        });
        this.glowMaterial = haloMaterial;
        const halo = new THREE.InstancedMesh(haloGeometry, haloMaterial, count);
        halo.name = "FallingStrawberryPinkGlow";
        halo.frustumCulled = false;
        halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        halo.renderOrder = 3;
        group.add(halo);
        this.glows = [halo];
        this.scene.add(group);

        for (let i = 0; i < count; i++) {
            const state: BerryState = {
                position: this.randomSpawnPosition(),
                fallSpeed: Math.random() * 3.2 + 2.6,
                swaySpeed: Math.random() * 0.45 + 0.2,
                swayOffset: Math.random() * Math.PI * 2,
                tiltAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
                tiltAngle: Math.random() * Math.PI * 2,
                spinAngle: Math.random() * Math.PI * 2,
                spinSpeed: Math.random() * 0.8 + 0.25,
                scale: Math.random() * 0.3 + 0.8,
            };
            this.states.push(state);
            this.writeMatrix(i, state);
        }
        this.meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
        this.glows.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    }

    update(_clock: THREE.Clock) {
        if (!this.group) return;
        // 独立计时：避免主动画循环已调用 clock.getDelta() 后再次调用而得到接近零的 dt。
        const nowMs = performance.now();
        const dt = this.lastTickMs > 0 ? Math.min(Math.max((nowMs - this.lastTickMs) / 1000, 0), 0.06) : 0.016;
        this.lastTickMs = nowMs;
        if (this.glowMaterial) this.glowMaterial.uniforms.uTime.value = nowMs / 1000;

        for (let i = 0; i < this.states.length; i++) {
            const berry = this.states[i]!;
            berry.position.y -= berry.fallSpeed * dt;
            berry.position.x += Math.sin(nowMs / 1000 * 1.5 + berry.swayOffset) * berry.swaySpeed * dt;
            berry.position.z += Math.cos(nowMs / 1000 + berry.swayOffset) * berry.swaySpeed * 0.6 * dt;
            berry.spinAngle += berry.spinSpeed * dt;
            // 落到底部后从顶部再次生成，永不停止。
            if (berry.position.y < -40) berry.position.copy(this.randomSpawnPosition(true));
            this.writeMatrix(i, berry);
        }
        this.meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
        this.glows.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    }

    dispose() {
        if (this.group) this.scene.remove(this.group);
        for (const mesh of this.meshes) {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            mesh.dispose();
        }
        for (const mesh of this.glows) {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            mesh.dispose();
        }
        this.glows = [];
        this.lastTickMs = 0;
        this.glowMaterial = null;
        this.group = null;
        this.meshes = [];
        this.states.length = 0;
    }

    private writeMatrix(index: number, berry: BerryState) {
        const tilt = new THREE.Quaternion().setFromAxisAngle(berry.tiltAxis, berry.tiltAngle);
        const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), berry.spinAngle);
        this.dummy.position.copy(berry.position);
        this.dummy.quaternion.copy(tilt.multiply(spin));
        this.dummy.scale.setScalar(berry.scale);
        this.dummy.updateMatrix();
        for (const mesh of this.meshes) mesh.setMatrixAt(index, this.dummy.matrix);
        // 光晕单独放大并跟随果实移动，靠自发光透明叠加产生柔光。
        // 光晕的朝向由 shader 处理，位置和缩放由 instanceMatrix 控制。
        this.dummy.quaternion.identity();
        this.dummy.scale.setScalar(berry.scale * 3.2);
        this.dummy.updateMatrix();
        for (const glow of this.glows) glow.setMatrixAt(index, this.dummy.matrix);
    }

    private createBerryGeometry() {
        const geometry = new THREE.SphereGeometry(0.43, 12, 10);
        const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            // 果实上宽下尖，顶端在 y = 0.4，尖端在 y = -0.5。
            const taper = THREE.MathUtils.lerp(0.32, 1.08, (y + 0.43) / 0.86);
            positions.setXYZ(i, x * taper, y * 1.1 - 0.03, z * taper);
        }
        geometry.computeVertexNormals();
        return geometry;
    }

    private createLeafGeometry() {
        const vertices: number[] = [];
        for (let i = 0; i < 5; i++) {
            const a = i * Math.PI * 2 / 5;
            const b = a + 0.36;
            const c = a - 0.36;
            // 五片向外展开的绿色萼片
            vertices.push(
                0, 0.39, 0,
                Math.cos(b) * 0.19, 0.44, Math.sin(b) * 0.19,
                Math.cos(a) * 0.52, 0.33, Math.sin(a) * 0.52,
                0, 0.39, 0,
                Math.cos(a) * 0.52, 0.33, Math.sin(a) * 0.52,
                Math.cos(c) * 0.19, 0.44, Math.sin(c) * 0.19,
            );
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        return geometry;
    }

    private createHighlightGeometry() {
        // 果实正面的小白色高光，随草莓一起旋转，制造亮晶晶的质感。
        const geometry = new THREE.SphereGeometry(0.075, 7, 6);
        geometry.scale(0.65, 1.1, 0.3);
        geometry.translate(-0.14, 0.13, 0.40);
        return geometry;
    }

    private createSeedGeometry() {
        const geos: THREE.BufferGeometry[] = [];
        // 外表面点缀 18 颗浅金色的种子
        for (let row = 0; row < 3; row++) {
            const y = 0.18 - row * 0.23;
            const phi = Math.acos(THREE.MathUtils.clamp((y + 0.03) / 0.47, -1, 1));
            const radius = 0.43 * Math.sin(phi) * THREE.MathUtils.lerp(0.32, 1.08, (y / 1.1 + 0.46) / 0.86);
            for (let j = 0; j < 6; j++) {
                const angle = (j + (row % 2) * 0.5) * Math.PI / 3;
                const seed = new THREE.SphereGeometry(0.031, 5, 4);
                seed.scale(0.8, 1.25, 0.55);
                seed.translate(Math.cos(angle) * (radius + 0.015), y, Math.sin(angle) * (radius + 0.015));
                geos.push(seed);
            }
        }
        const merged = mergeGeometries(geos, false);
        geos.forEach(g => g.dispose());
        if (!merged) throw new Error("Failed to build strawberry seeds");
        return merged;
    }

    private randomSpawnPosition(reset = false) {
        return new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(120),
            reset ? THREE.MathUtils.randFloat(30, 50) : THREE.MathUtils.randFloat(-20, 40),
            -(25 + Math.random() * 45)
        );
    }

    private getResponsiveParticleCount(base: number) {
        const perf = this.config.performance;
        if (!perf?.responsiveParticles || typeof window === "undefined") return base;
        if (window.innerWidth >= perf.smallDeviceWidth) return base;
        return Math.max(1, Math.floor(base * (perf.particleScale?.snow ?? 1)));
    }
}
