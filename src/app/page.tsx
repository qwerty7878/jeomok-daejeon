import { getPublicRooms } from "@/lib/get-public-rooms";
import { LobbyClient } from "./LobbyClient";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const initialRooms = await getPublicRooms().catch(() => []);
  return <LobbyClient initialRooms={initialRooms} />;
}
