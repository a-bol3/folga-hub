"use server";

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function login(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Credenciales inválidas. Por favor, regístrese si es un nuevo usuario." };
    }
    if (error.message.includes("Email not confirmed")) {
      // Auto-repair: Confirm the user if they exist
      try {
        const adminClient = createAdminClient();
        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const userToFix = (users as any[]).find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (userToFix) {
          await adminClient.auth.admin.updateUserById(userToFix.id, { email_confirm: true });
          return { error: "TU EMAIL HA SIDO AUTO-CONFIRMADO. Intenta entrar de nuevo ahora." };
        }
      } catch (repairErr) {
        console.error("Auto-repair failed:", repairErr);
      }
      return { error: "EMAIL NO CONFIRMADO. Por favor, revisa tu bandeja de entrada." };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const adminClient = createAdminClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string || "RECRUITER";

  // Use Admin API to create user confirmed by default
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role }
  });

  if (error) {
    if (error.message.includes("rate limit")) {
      return { error: "Límite de registros excedido. Espere un momento o contacte soporte." };
    }
    return { error: error.message };
  }

  if (data.user) {
    try {
      await prisma.user.upsert({
        where: { email },
        update: { role: role as any },
        create: {
          id: data.user.id,
          email,
          role: role as any,
        }
      });
    } catch (dbError) {
      console.error("Auth Post-Process Error:", dbError);
    }
  }

  // Since we used Admin API, we didn't get a session for the client.
  // We need to sign in the user now manually to get the session/cookies.
  const cookieStore = await cookies();
  const clientSupabase = createClient(cookieStore);
  const { error: signInError } = await clientSupabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "CUENTA CREADA. Por favor, inicie sesión manualmente." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  await supabase.auth.signOut();
  
  revalidatePath("/", "layout");
  redirect("/login");
}
