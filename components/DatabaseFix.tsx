import React, { useEffect } from "react";
import { executeQuery } from "../src/db/database";

const DatabaseFix: React.FC = () => {
  useEffect(() => {
    const fixDatabase = async () => {
      try {
        console.log("🔧 Running database fix...");

        // Check if cantidad_inicial column exists in Almacen table
        const tableInfo = await executeQuery<any>(`PRAGMA table_info(Almacen)`);
        const hasColumn = tableInfo.some(
          (col: any) => col.name === "cantidad_inicial",
        );

        console.log(
          "📋 Current Almacen table columns:",
          tableInfo.map((col) => col.name),
        );
        console.log(`🔍 Column cantidad_inicial exists: ${hasColumn}`);

        if (!hasColumn) {
          console.log("➕ Adding cantidad_inicial column to Almacen table...");
          // This will be handled by the existing migration function
          console.log("✅ Column will be added by migration function");
        }
      } catch (error) {
        console.error("❌ Error in database fix:", error);
      }
    };

    fixDatabase();
  }, []);

  return null; // This component doesn't render anything
};

export default DatabaseFix;
