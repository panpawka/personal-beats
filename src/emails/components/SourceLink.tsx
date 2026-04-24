import { Button, Link, Text } from "@react-email/components";

interface Props {
  url: string;
  variant?: "button" | "inline";
  label?: string;
}

export function SourceLink({ url, variant = "button", label }: Props) {
  const host = safeHost(url);
  const text = label ?? host;
  if (variant === "inline") {
    return (
      <Link href={url} className="text-blue-700 underline text-sm">
        {text}
      </Link>
    );
  }
  return (
    <Button
      href={url}
      className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm no-underline"
    >
      {text} →
    </Button>
  );
}

export function SecondarySources({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  return (
    <Text className="text-xs text-gray-500 m-0 mt-2">
      Also:{" "}
      {urls.map((u, i) => (
        <span key={u}>
          <SourceLink url={u} variant="inline" />
          {i < urls.length - 1 ? " · " : ""}
        </span>
      ))}
    </Text>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
