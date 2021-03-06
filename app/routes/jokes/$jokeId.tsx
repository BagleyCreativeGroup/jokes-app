import type { joke } from "@prisma/client";
import type {
  ActionFunction,
  LoaderFunction,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useParams,
  useCatch,
  Form,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import { getUserId, requireUserId } from "~/utils/session.server";

export const meta: MetaFunction = ({
  data,
}: {
  data: LoaderData | undefined;
}) => {
  if (!data) {
    return {
      title: "No Joke",
      description: "No joke found",
    };
  }

  return {
    title: `"${data.joke.name}" joke`,
    description: `Enjoy "${data.joke.name}" joke`,
  };
};

type LoaderData = { joke: joke; isOwner: boolean };

export const loader: LoaderFunction = async ({ request, params }) => {
  const userId = await getUserId(request);

  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });

  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }

  const data: LoaderData = { joke, isOwner: userId === joke.jokesterId };

  return json(data);
};

export const action: ActionFunction = async ({ request, params }) => {
  const form = await request.formData();

  if (form.get("_method") !== "delete") {
    throw new Response(
      `The form method ${form.get("_method")} is not supported.`,
      {
        status: 400,
      },
    );
  }

  const userId = await requireUserId(request);

  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });

  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }

  if (joke.jokesterId !== userId) {
    throw new Response(`Nice try, but this is not your joke.`, {
      status: 401,
    });
  }

  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function Joke() {
  const data = useLoaderData<LoaderData>();

  return (
    <>
      <p>Here is your joke...</p>

      <p>{data.joke.content}</p>

      <Link to=".">{data.joke.name}</Link>

      {data.isOwner ? (
        <Form>
          <input type="hidden" name="_method" value="delete" />

          <button type="submit" className="button">
            Delete
          </button>
        </Form>
      ) : null}
    </>
  );
}

export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();

  switch (caught.status) {
    case 400: {
      return (
        <div className="error-container">
          What your trying to do here is not allowed.
        </div>
      );
    }
    case 401: {
      return (
        <div className="error-container">
          Apologies, but {params.jokeId} is not your joke.
        </div>
      );
    }
    case 404: {
      return (
        <div className="error-container">
          Huh? What the heck is "{params.jokeId}"?
        </div>
      );
    }
  }

  throw new Error(`Unhandled error: ${caught.status}`);
}

export function ErrorBoundary() {
  const { jokeId } = useParams();

  return (
    <div className="error-container">
      {`There was an error loading joke with the id of ${jokeId}. Sorry.`}
    </div>
  );
}
