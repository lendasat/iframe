import { Avatar } from "@radix-ui/themes";

interface AvatarProps {
    name: string,
    rest: HTMLImageElement,
}

export default function AvatarCP({ name, ...rest }: AvatarProps) {
    return (
        <Avatar
            {...rest}
            radius="full"
            color="purple"
            fallback={name.substring(0, 1)} />
    )
}
