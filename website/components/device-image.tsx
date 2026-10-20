import { basePath } from '@/lib/shared';

/** The device illustrations in public/images, the same ones the app uses in Homey. */
export type Device = 'app' | 'gateway' | 'ventilation-unit' | 'remote' | 'room-sensor' | 'virtual-co2-sensor';

/** A device illustration floated next to the text, as on a device page. */
export function DeviceImage({ device, alt, width = 140 }: { device: Device; alt: string; width?: number }) {
  return (
    <img
      src={`${basePath}/images/${device}.png`}
      alt={alt}
      width={width}
      className="not-prose float-right mb-4 ml-6 rounded-xl max-sm:hidden"
    />
  );
}

/** A small device illustration inline, for tables. */
export function DeviceIcon({ device }: { device: Device }) {
  return <img src={`${basePath}/images/${device}.png`} alt="" width={36} height={36} className="not-prose m-0 inline-block align-middle" />;
}
