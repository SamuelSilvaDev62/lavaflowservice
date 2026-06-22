VehicleVisual looks for lightweight transparent PNG/WebP files in this folder.

Naming priority:
- brand-model-year.webp/png, for example `honda-civic-2020.webp`
- brand-model.webp/png, for example `toyota-hilux.webp`
- generic-type.webp/png, for example `generic-suv.webp`
- generic-car.webp/png

If no asset exists, the app renders a CSS fallback vehicle, so missing files never break the UI.
