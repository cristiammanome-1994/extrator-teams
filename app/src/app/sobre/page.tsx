import { ChangelogView } from "@/components/sobre/changelog-view";
import { SobreView } from "@/components/sobre/sobre-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SobrePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sobre</h1>
        <p className="text-sm text-muted-foreground">Para que serve o Extrator Teams e o que mudou nele.</p>
      </div>

      <Tabs defaultValue="sobre">
        <TabsList variant="line">
          <TabsTrigger value="sobre">Sobre</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>

        <TabsContent value="sobre" className="pt-4">
          <SobreView />
        </TabsContent>

        <TabsContent value="changelog" className="max-w-2xl pt-4">
          <ChangelogView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
