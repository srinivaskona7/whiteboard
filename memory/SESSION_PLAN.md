# Session Plan: StudioBoard Reliability, DevOps Architecture & Live Teaching Upgrade

## User Requirements & Acceptance Criteria
1. **Fix Invisible Icon Insertion & Coordinate Math**:
   - Reproduce and fix the bug where selecting `aws-ec2` and `aws-s3` in Library → Multi-Select → Connected Flow produced `NaN`/`null` coordinates (`computeNonOverlappingOrigin` signature mismatch).
   - Implement one tested screen-to-world conversion (`screenToWorldPoint` and `getUsableViewportCenterWorld`) accounting for canvas bounds, camera translation, zoom, and open side panels.
   - Validate all geometry with `Number.isFinite` (`isValidElementGeometry`, `validateElementsBatch`) before committing, persisting, exporting, or syncing. Never serialize invalid geometry into `null`. Reject failed insertions with a clear toast message and leave the board unchanged.
   - Insert batches (`grid`, `row`, `column`, `flow`) as one undoable transaction with unique IDs, valid dimensions, connector bindings, and a live placement preview on canvas before committing.
   - Add "Zoom to selection" separately from "Fit entire board" and include all supported element types in bounds calculations.
2. **Make Spotlight & Teaching Modes Easy to Exit**:
   - Keep Teaching → Spotlight & Magnifier and `Escape` to exit Spotlight.
   - Display a compact floating control reading `"Spotlight on · Esc to exit"` with a visible close button, radius control, dimming control, and separate Spotlight vs Magnifier toggles.
   - Prevent Spotlight from drawing, selecting, or dragging objects on the canvas; keep overlay out of saved content and exports.
   - Show consistent mode indicators for Spotlight, laser, fading annotation, presentation, and teaching focus.
   - Define explicit `Escape` hierarchy: dismiss active dialog/palette first -> cancel current interaction/preview -> exit active teaching mode -> clear selection. Never intercept `Escape`, letter shortcuts, or arrow keys while editing text or typing in inputs.
3. **Improve Connectors Without Removing Existing Controls**:
   - Retain Straight, Right-Angle (`orthogonal`), and Curved routing; separate route geometry, line appearance (`solid`, `dashed`, `dotted`), and direction.
   - Provide clear direction presets: Plain (`none`/`none`), One-way (`none`/`arrow`), Two-way (`arrow`/`arrow`) alongside Start/End Cap selectors.
   - Add editable color, width, label, label position (`labelT`), and quick protocol label chips (`HTTPS`, `TCP 443`, `DNS`, `gRPC`, `replication`).
   - Support automatic boundary/port selection (`auto`) plus explicit `top`, `right`, `bottom`, `left`, and custom perimeter ports.
   - Show source and destination attachment previews before release; keep connectors attached across move, resize, rotate, group, and container drag.
   - Draw direct segments for straight routes, draggable segments + obstacle avoidance for right-angle routes, and understandable bend handle + "Reset Route" for curves.
   - Calculate arrowhead orientation from the final non-zero segment or curve tangent; keep manually adjusted routes stable until reset.
   - Provide explicit architecture auto-layout (`scene/layout.js`) and document ELK.js / libavoid evaluation.
4. **Official-Style DevOps Icon Packs, Provenance Manifest & Aspect Ratio Preservation**:
   - Bundle curated, distinct vector icons with provenance metadata (`stencils/manifest.js`) referencing official upstream sources (AWS, Azure, GCP, Kubernetes, CNCF, Devicon).
   - Distinguish provider service icons, resource icons, architecture boundary/group containers (Account, Region, VPC, Subnet, Cluster, Namespace), brand tool logos (Jenkins, GitHub Actions, GitLab CI, Argo CD, Flux, Terraform, OpenTofu, Ansible, Helm, Kustomize, Prometheus, Grafana, Loki, OpenTelemetry, Vault, Trivy, PostgreSQL, Redis, Kafka, RabbitMQ, Linux distros), and generic teaching concepts (processes, sockets, packets, disks, routers, firewalls, DNS, TLS, Linux internals).
   - Preserve 1:1 SVG aspect ratios on canvas and in SVG/PNG exports (`preserveAspectRatio="xMidYMid meet"` uniform scaling), keep captions separate and editable, and provide light/dark contrast backplates.
5. **Fast, Practical Library & Real Boundary Containers**:
   - Provide category filters, abbreviation search aliases (`EC2`, `AKS`, `GKE`, `LB`, `SG`, `PVC`, `DNS`, etc.), favorites (`★`), recent items (`🕒`), compact/comfortable preview sizes, and keyboard arrow navigation.
   - Expose Insert Grid, Insert Row, Insert Column, and Connected Flow with obvious selection state and canvas placement preview.
   - Virtualize/window long stencil lists so large catalogues never slow canvas drawing.
   - Make architecture boundaries act as real containers that optionally move their contents and preserve internal connections.
6. **Genuinely Short Sharing Links**:
   - Replace 74,000+ char URLs with short stored board/room links (`#/b/{id}`, `#/r/{roomId}`, `#/r/{roomId}?invite={token}`) resolved via the configured backend.
   - Separate read-only snapshot sharing, live classroom joining, and authorized editing invitations using collision-resistant IDs and server-verified capability tokens.
   - Copy links only after successful creation; show access level, expiration, optional QR code, and clear offline/error states. Retain long `#scene=...` links as a clearly labeled offline fallback.
7. **Real Classroom Collaboration (WebSocket + Persistent Store)**:
   - Implement persistent HTTP + WebSocket collaboration backend (`server/collab-server.js` + Vite middleware) and client (`scene/collab-client.js`).
   - Keep board elements, questions, replies, and resolutions persistent; keep cursors, selections, and presence ephemeral.
   - Require participant display name before pointing or asking a question; render named cursors in board coordinates (accurate across zoom/viewport, hidden on other pages, throttled & interpolated, never saved to undo history).
   - Enforce `teacher`, `editor`, and `viewer` roles on the server; support "Follow teacher" with an obvious stop-following control.
   - Anchor questions to element IDs and relative positions; preserve question position with a clear note when its anchor element is deleted; support Locate, Reply, Resolve, Reopen, and Unanswered filtering.
8. **Refine the Interface for Teaching**:
   - Keep canvas dominant: compact primary dock (`Select`, `Pan`, `Pen`, `Highlighter`, `Eraser`, `Rect`, `Connector`, `Text`, `Sticky`, `Laser`, `Point`, `Question`, `+ Insert`), moving advanced shapes, images, tables, code, stamps, and math overlays into `+ Insert`.
   - Customizable Teaching Focus mode showing only explanation tools, question access, and lesson navigation.
   - Responsive collapsible panels on desktop and bottom sheets/drawers on mobile (`390px`); SVG favicon and human-friendly save/connection/teaching status indicators.
9. **Complete Feature Audit, Automated Tests & Performance Profiling**:
   - Update `feature-list.md` with full feature inventory and verification status.
   - Add automated unit/integration tests (`tests/scene.test.js`, `tests/collab.test.js`) and headless browser E2E verification across two independent browser contexts, 390px/768px/1440px viewports, and 100 / 1,000 / 5,000 object performance benchmarks.

## Step-by-Step Execution Checklist
- [x] **Step 1**: Fix coordinate conversion (`screenToWorldPoint`, `getUsableViewportCenterWorld`), `computeNonOverlappingOrigin`, `Number.isFinite` geometry validation (`isValidElementGeometry`, `validateElementsBatch`), batch insertion (`grid`, `row`, `column`, `flow`) with placement preview, and `zoomToSelection` vs `fitToContent`.
- [x] **Step 2**: Upgrade connectors (`scene/geometry.js`, `scene/bindings.js`, `scene/routing.js`, `scene/layout.js`, `tools/connector.js`, `render/shapes.js`, `ui/props-panel.js`) with direction presets (Plain, One-way, Two-way), auto boundary attachment + explicit/custom ports, attachment previews, tangent arrowheads, route stability + Reset Route, protocol label chips, and architecture auto-layout.
- [x] **Step 3**: Upgrade icon packs, provenance manifest (`stencils/manifest.js`), aspect-ratio-preserving renderer (`stencils/card.js`), boundary containers, and generic teaching concepts (`stencils/devops-cloud.js`, `stencils/devops-infra.js`, `stencils/devops-cicd.js`, `stencils/devops-data-sec.js`, `stencils/concepts.js`, `stencils/index.js`).
- [x] **Step 4**: Upgrade Library panel (`ui/library-panel.js`) with abbreviation search aliases, Favorites, Recent items, Compact/Comfortable sizes, keyboard navigation, virtualized rendering, and Grid/Row/Column/Flow placement preview.
- [x] **Step 5**: Upgrade Spotlight, Magnifier, Teaching Focus customization, explicit Escape hierarchy, and human-friendly topbar/floating mode indicators (`main.js`, `ui/toolbar.js`, `render/canvas.js`, `index.html`, `styles.css`).
- [x] **Step 6**: Implement short sharing links & real WebSocket classroom collaboration backend + client (`server/collab-server.js`, `vite.config.js`, `scene/collab-client.js`, `ui/classroom.js`, `ui/dialogs.js`, `ui/qr.js`) with role enforcement, named board-coordinate cursors, Follow Teacher, and question anchoring/deletion handling.
- [x] **Step 7**: Write comprehensive unit, integration, and multi-client browser E2E tests (`tests/scene.test.js`, `tests/collab.test.js`), profile 100 / 1,000 / 5,000 objects, update `feature-list.md` and documentation, and verify `npm test` and `npm run build`.
- [x] **Step 8**: Push `main` to GitHub (`git push origin main`) and verify GitHub Actions `CI` and `Deploy to GitHub Pages` workflow runs succeed.
